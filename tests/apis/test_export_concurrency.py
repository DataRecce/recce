"""Tests for export endpoint concurrency and thread safety."""

import asyncio

import pytest

from recce.apis.export_utils import MAX_CONCURRENT_EXPORTS


@pytest.fixture(autouse=True)
def reset_semaphore():
    """Reset the module-level semaphore between tests."""
    import recce.apis.run_api as run_api_mod

    run_api_mod._export_semaphore = None
    yield
    run_api_mod._export_semaphore = None


def test_get_export_semaphore_creates_semaphore():
    """Lazy init creates a semaphore with correct concurrency."""
    from recce.apis.run_api import _get_export_semaphore

    sem = _get_export_semaphore()
    assert isinstance(sem, asyncio.Semaphore)
    assert sem._value == MAX_CONCURRENT_EXPORTS


def test_get_export_semaphore_returns_same_instance():
    """Repeated calls return the same semaphore instance."""
    from recce.apis.run_api import _get_export_semaphore

    sem1 = _get_export_semaphore()
    sem2 = _get_export_semaphore()
    assert sem1 is sem2


@pytest.mark.asyncio
async def test_semaphore_limits_concurrent_access():
    """Semaphore should track available slots correctly."""
    from recce.apis.run_api import _get_export_semaphore

    sem = _get_export_semaphore()

    # Initially all slots available
    assert sem._value == MAX_CONCURRENT_EXPORTS

    # Acquire all slots
    for _ in range(MAX_CONCURRENT_EXPORTS):
        await sem.acquire()

    # No slots left
    assert sem._value == 0

    # Release one
    sem.release()
    assert sem._value == 1

    # Release the rest
    for _ in range(MAX_CONCURRENT_EXPORTS - 1):
        sem.release()
    assert sem._value == MAX_CONCURRENT_EXPORTS


@pytest.mark.asyncio
async def test_semaphore_fast_reject_when_exhausted():
    """When all slots are taken, new requests should be rejectable."""
    from recce.apis.run_api import _get_export_semaphore

    sem = _get_export_semaphore()

    # Fill all slots
    for _ in range(MAX_CONCURRENT_EXPORTS):
        await sem.acquire()

    # Simulate the fast-reject check used in export_run_handler
    assert sem._value <= 0, "Should have no available slots"

    # Clean up
    for _ in range(MAX_CONCURRENT_EXPORTS):
        sem.release()


@pytest.mark.asyncio
async def test_semaphore_async_with_releases_on_completion():
    """async with should release the slot when the block exits."""
    from recce.apis.run_api import _get_export_semaphore

    sem = _get_export_semaphore()
    initial = sem._value

    async with sem:
        assert sem._value == initial - 1

    assert sem._value == initial


@pytest.mark.asyncio
async def test_semaphore_async_with_releases_on_exception():
    """async with should release the slot even if the block raises."""
    from recce.apis.run_api import _get_export_semaphore

    sem = _get_export_semaphore()
    initial = sem._value

    with pytest.raises(RuntimeError):
        async with sem:
            raise RuntimeError("simulated export failure")

    assert sem._value == initial, "Semaphore slot should be released after exception"
