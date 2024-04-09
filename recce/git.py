from git import Repo


def current_branch():
    try:
        repo = Repo(search_parent_directories=True)
        if not repo.active_branch:
            return None
        return repo.active_branch.name
    except TypeError:
        # happened when HEAD is a detached symbolic reference
        return None
    except Exception:
        return None
