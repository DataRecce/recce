import os

from git import Repo, InvalidGitRepositoryError


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


def hosting_repo(remote: str = 'origin'):
    try:
        repo = Repo(search_parent_directories=True)
        origin_url = repo.remote(name=remote).url
        remote_repo = None

        if origin_url.startswith('git@'):
            # Handle git@github.com:user/repo.git
            remote_repo = origin_url.split(':')[1].replace('.git', '')

        elif origin_url.startswith('https://') or origin_url.startswith('http://'):
            # Handle https://github.com/user/repo.git or http://github.com/user/repo.git
            remote_repo = '/'.join(origin_url.split('/')[-2:]).replace('.git', '')

        return remote_repo
    except ValueError:
        repo = Repo(search_parent_directories=True)
        toplevel_dir = repo.git.rev_parse("--show-toplevel")

        return os.path.basename(toplevel_dir)
    except InvalidGitRepositoryError:
        return None
