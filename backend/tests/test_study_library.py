from datetime import timedelta

import pytest

from app.models import AIContent, Course, Note, Video, now
from app.routers.study_library import note_text

SUMMARY = {"hook": "Closures retain lexical scope", "keyPoints": ["Remember & revisit variables"]}
QUIZ = {
    "questions": [
        {"question": "HiddenQuestion", "options": ["SecretAnswer", "B", "C", "D"], "answer": 0}
    ]
}


def test_note_search_preserves_inline_text_and_decodes_entities():
    assert note_text("<p>clo<b>su</b>res &amp; scope</p><p>next</p>") == "closures & scope next"


async def seed(factory):
    async with factory() as db:
        db.add(
            Course(id="course-c", user_id="user-a", youtube_playlist_id="PLother", title="React")
        )
        await db.flush()
        video = await db.get(Video, "video-a")
        video.ai_content_unlocked_at = now() - timedelta(days=2)
        video.is_available = False
        db.add_all(
            [
                Note(
                    video_id="video-a",
                    content="<p>Hooks &amp; closures</p><p>Second paragraph</p><script>HiddenScript</script>",
                ),
                Note(video_id="video-b", content="OtherUserSecret"),
                AIContent(
                    youtube_video_id="abcdefghijk", status="ready", summary=SUMMARY, quiz=QUIZ
                ),
                AIContent(
                    youtube_video_id="lmnopqrstuv", status="ready", summary=SUMMARY, quiz=QUIZ
                ),
                Video(
                    id="video-c",
                    course_id="course-c",
                    youtube_video_id="abcdefghijk",
                    title="Locked React",
                    position=0,
                ),
                Video(
                    id="video-d",
                    course_id="course-c",
                    youtube_video_id="zyxwvutsrqp",
                    title="Zebra",
                    position=1,
                ),
            ]
        )
        await db.flush()
        db.add(
            Note(
                video_id="video-d",
                content="<h2>Independent idea</h2>",
                updated_at=now() - timedelta(days=5),
            )
        )
        await db.commit()


async def test_library_resources_metadata_and_ownership(setup):
    client, factory, _ = setup
    await seed(factory)
    response = await client.get("/api/study-library")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["resourceTotal"] == data["total"] == 4
    assert data["counts"] == {"all": 4, "notes": 2, "summary": 1, "quiz": 1}
    assert {c["id"] for c in data["courses"]} == {"course-a", "course-c"}
    assert all(item["videoId"] not in {"video-b", "video-c"} for item in data["items"])
    note = next(item for item in data["items"] if item["id"] == "video-a:notes")
    assert note["preview"] == "Hooks & closures Second paragraph"
    assert note["isAvailable"] is False  # Saved resources survive video archival.
    assert "HiddenQuestion" not in response.text
    assert "SecretAnswer" not in response.text
    assert "OtherUserSecret" not in response.text
    assert "HiddenScript" not in response.text


@pytest.mark.parametrize(
    "query,types",
    [
        ("  lexical scope  ", ["summary"]),
        ("HOOKS & closures", ["notes"]),
        ("Python", ["notes", "summary", "quiz"]),
        ("Intro", ["notes", "summary", "quiz"]),
        ("HiddenQuestion", []),
        ("SecretAnswer", []),
        ("HiddenScript", []),
        ("Second paragraph", ["notes"]),
    ],
)
async def test_search_visible_content_without_quiz_answers(setup, query, types):
    client, factory, _ = setup
    await seed(factory)
    data = (await client.get("/api/study-library", params={"q": query})).json()
    assert sorted(item["type"] for item in data["items"]) == sorted(types)


async def test_combined_filters_counts_pagination_and_stable_sort(setup):
    client, factory, _ = setup
    await seed(factory)
    data = (
        await client.get(
            "/api/study-library", params={"type": "notes", "courseId": "course-a", "q": "Intro"}
        )
    ).json()
    assert data["total"] == 1
    assert data["counts"] == {"all": 3, "notes": 1, "summary": 1, "quiz": 1}
    first = (await client.get("/api/study-library?sort=oldest&pageSize=1")).json()
    assert first["items"][0]["videoId"] == "video-d"
    pages = [
        (await client.get(f"/api/study-library?sort=title&pageSize=1&page={p}")).json()
        for p in range(1, 5)
    ]
    assert len({p["items"][0]["id"] for p in pages}) == 4
    assert pages[-1]["items"][0]["videoTitle"] == "Zebra"
    assert (await client.get("/api/study-library?pageSize=1&page=99")).json()["page"] == 4
    assert (await client.get("/api/study-library?courseId=course-b")).status_code == 403
    assert (await client.get("/api/study-library?courseId=missing")).status_code == 404
    client.cookies.clear()
    assert (await client.get("/api/study-library")).status_code == 401


async def test_empty_pending_failed_and_missing_resources(setup):
    client, factory, _ = setup
    assert (await client.get("/api/study-library")).json()["resourceTotal"] == 0
    async with factory() as db:
        video = await db.get(Video, "video-a")
        video.ai_content_unlocked_at = now()
        db.add(Note(video_id=video.id, content="<p>&nbsp; </p><style>Hidden</style>"))
        ai = AIContent(
            youtube_video_id=video.youtube_video_id, status="pending", summary=SUMMARY, quiz=QUIZ
        )
        db.add(ai)
        await db.commit()
        assert (await client.get("/api/study-library")).json()["total"] == 0
        ai.status = "failed"
        await db.commit()
        assert (await client.get("/api/study-library")).json()["total"] == 0
        ai.status = "ready"
        ai.summary = None
        ai.quiz = None
        await db.commit()
    assert (await client.get("/api/study-library")).json()["total"] == 0


@pytest.mark.parametrize(
    "query", ["type=chat", "sort=invalid", "page=0", "pageSize=101", "pageSize=0", "q=" + "x" * 201]
)
async def test_library_parameter_validation(setup, query):
    client, _, _ = setup
    assert (await client.get("/api/study-library?" + query)).status_code == 400
