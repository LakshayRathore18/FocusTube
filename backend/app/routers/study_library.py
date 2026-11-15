from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from ..dependencies import DB, CurrentUser, owned_course
from ..models import AIContent, Course, Note, Video
from ..schemas import LibraryCounts, LibraryResource, StudyLibrary

router = APIRouter(prefix="/study-library", tags=["study-library"])


class NoteText(HTMLParser):
    """Extract visible text without executing HTML or indexing markup/script contents."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1
        elif not self.hidden and tag in {"p", "div", "br", "li", "h2", "h3"}:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        elif not self.hidden and tag in {"p", "div", "br", "li", "h2", "h3"}:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def note_text(content: str) -> str:
    parser = NoteText()
    parser.feed(content)
    return " ".join("".join(parser.parts).split())


def utc_date(value: datetime) -> datetime:
    # SQLite test dates are naive; PostgreSQL dates may carry a non-UTC offset.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@router.get("", response_model=StudyLibrary)
async def study_library(
    db: DB,
    user: CurrentUser,
    q: str = Query(default="", max_length=200),
    resource_type: Literal["all", "notes", "summary", "quiz"] = Query(default="all", alias="type"),
    course_id: str | None = Query(default=None, alias="courseId"),
    sort: Literal["recent", "oldest", "title"] = "recent",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100, alias="pageSize"),
):
    if course_id:
        await owned_course(db, course_id, user.id)
    courses = (
        await db.execute(
            select(Course.id, Course.title)
            .where(Course.user_id == user.id)
            .order_by(Course.title, Course.id)
        )
    ).all()
    # Select only library fields; never load transcripts or other users' rows.
    rows = (
        await db.execute(
            select(
                Video.id,
                Video.youtube_video_id,
                Video.title,
                Video.course_id,
                Course.title,
                Video.is_available,
                Video.ai_content_unlocked_at,
                Note.content,
                Note.updated_at,
                AIContent.status,
                AIContent.summary,
                AIContent.quiz,
                AIContent.updated_at,
            )
            .join(Course, Course.id == Video.course_id)
            .outerjoin(Note, Note.video_id == Video.id)
            .outerjoin(AIContent, AIContent.youtube_video_id == Video.youtube_video_id)
            .where(Course.user_id == user.id)
        )
    ).all()
    resources = []
    for (
        video_id,
        youtube_id,
        title,
        cid,
        course_title,
        available,
        unlocked,
        content,
        note_date,
        ai_status,
        summary,
        quiz,
        ai_date,
    ) in rows:
        base = dict(
            video_id=video_id,
            youtube_video_id=youtube_id,
            video_title=title,
            course_id=cid,
            course_title=course_title,
            is_available=available,
        )
        if content and (text := note_text(content)):
            resources.append(
                (
                    LibraryResource(
                        **base,
                        id=f"{video_id}:notes",
                        type="notes",
                        preview=text[:180],
                        updated_at=utc_date(note_date),
                    ),
                    text,
                )
            )
        if not unlocked or ai_status != "ready":
            continue
        # Use the later of generation and this video's per-user unlock.
        date = max(utc_date(unlocked), utc_date(ai_date))
        if isinstance(summary, dict) and summary.get("hook") and summary.get("keyPoints"):
            text = " ".join(" ".join([summary["hook"], *summary["keyPoints"]]).split())
            resources.append(
                (
                    LibraryResource(
                        **base,
                        id=f"{video_id}:summary",
                        type="summary",
                        preview=text[:180],
                        updated_at=date,
                    ),
                    text,
                )
            )
        if isinstance(quiz, dict) and quiz.get("questions"):
            resources.append(
                (
                    LibraryResource(
                        **base,
                        id=f"{video_id}:quiz",
                        type="quiz",
                        preview="Test your understanding of this lesson.",
                        updated_at=date,
                    ),
                    "",
                )
            )
    query = " ".join(q.split()).casefold()
    matched = [
        resource
        for resource, text in resources
        if (not course_id or resource.course_id == course_id)
        and (
            not query
            or query in f"{resource.video_title} {resource.course_title} {text}".casefold()
        )
    ]
    counts = LibraryCounts(all=len(matched))
    for resource in matched:
        setattr(counts, resource.type, getattr(counts, resource.type) + 1)
    items = [item for item in matched if resource_type == "all" or item.type == resource_type]
    if sort == "title":
        items.sort(key=lambda item: (item.video_title.casefold(), item.id))
    else:
        items.sort(key=lambda item: (item.updated_at, item.id), reverse=sort == "recent")
    total = len(items)
    # Clamp after deletions so a previously valid final page does not become a dead end.
    page = min(page, max(1, (total + page_size - 1) // page_size))
    start = (page - 1) * page_size
    return StudyLibrary(
        items=items[start : start + page_size],
        total=total,
        resource_total=len(resources),
        counts=counts,
        courses=[dict(id=cid, title=title) for cid, title in courses],
        page=page,
        page_size=page_size,
    )
