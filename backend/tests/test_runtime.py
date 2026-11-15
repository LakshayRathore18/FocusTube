import asyncio
import sys

from uvicorn import Config


def test_uvicorn_uses_database_compatible_loop():
    factory = Config("app.main:app", loop="app.runtime:database_event_loop").get_loop_factory()
    loop = factory()
    try:
        if sys.platform == "win32":
            assert isinstance(loop, asyncio.SelectorEventLoop)

        async def running_loop():
            return asyncio.get_running_loop()

        assert loop.run_until_complete(running_loop()) is loop
    finally:
        loop.close()
