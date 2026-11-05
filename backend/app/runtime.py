"""Event loop compatible with psycopg's asynchronous connections on Windows."""

import asyncio
import sys


def database_event_loop():
    if sys.platform == "win32":
        return asyncio.SelectorEventLoop()
    return asyncio.new_event_loop()
