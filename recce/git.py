from git import Repo


def current_branch():
    try:
        repo = Repo(search_parent_directories=True)
    except Exception:
        return None

    if not repo.active_branch:
        return None

    return repo.active_branch.name
