import gzip
import os
import tempfile
from abc import ABC, ABCMeta, abstractmethod
from enum import Enum


class SupportedFileTypes(Enum):
    FILE = "file"
    GZIP = "gzip"
    ZIP = "zip"


def file_io_factory(file_type: SupportedFileTypes):
    if file_type == SupportedFileTypes.FILE:
        return FileIO
    elif file_type == SupportedFileTypes.GZIP:
        return GzipFileIO
    elif file_type == SupportedFileTypes.ZIP:
        return ZipFileIO
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


class AbstractFileIO(metaclass=ABCMeta):
    @staticmethod
    @abstractmethod
    def write(path: str, data: str, **kwargs):
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def read(path: str, **kwargs) -> str:
        raise NotImplementedError


class FileIO(AbstractFileIO, ABC):
    @staticmethod
    def write(path: str, data: str, **kwargs):
        with open(path, "w") as f:
            f.write(data)

    @staticmethod
    def read(path: str, **kwargs) -> str:
        with open(path, "r") as f:
            return f.read()


class GzipFileIO(AbstractFileIO, ABC):
    @staticmethod
    def write(path: str, data: str, **kwargs):
        with gzip.open(path, "wt") as f:
            f.write(data)

    @staticmethod
    def read(path: str, **kwargs) -> str:
        with gzip.open(path, "rt") as f:
            return f.read()

    @staticmethod
    def read_fileobj(fileobj) -> bytes:
        with gzip.GzipFile(fileobj=fileobj) as f:
            return f.read()


class ZipFileIO(AbstractFileIO, ABC):
    @staticmethod
    def _is_pyminizip_installed():
        try:
            import pyminizip

            # Use the module to avoid F401
            return pyminizip is not None
        except ImportError:
            raise ImportError("pyminizip is not installed. Please install it using `pip install pyminizip`")

    @staticmethod
    def read(path: str, **kwargs) -> str:
        ZipFileIO._is_pyminizip_installed()
        import pyminizip

        cwd = os.getcwd()
        password = kwargs.get("password")
        zip_dir_name = kwargs.get("zip_dir_name")
        if zip_dir_name is None:
            raise ValueError("zip_dir_name is required for zipping")

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_file = os.path.join(tmp_dir, zip_dir_name)
                pyminizip.uncompress(path, password, tmp_dir, 0)
                content = FileIO.read(tmp_file)
        except Exception as e:
            error_msg = str(e)
            if "-3" in error_msg:
                raise Exception("Invalid password to uncompress state file.")
            raise Exception(f"Failed to uncompress state file: {error_msg}")
        finally:
            os.chdir(cwd)

        return content

    @staticmethod
    def write(path: str, data: str, **kwargs):
        ZipFileIO._is_pyminizip_installed()
        import pyminizip

        cwd = os.getcwd()
        password = kwargs.get("password")
        zip_dir_name = kwargs.get("zip_dir_name")
        if zip_dir_name is None:
            raise ValueError("zip_dir_name is required for zipping")

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_file = os.path.join(tmp_dir, zip_dir_name)
                FileIO.write(tmp_file, data)
                pyminizip.compress(tmp_file, None, path, password, 9)
        finally:
            os.chdir(cwd)
