import pydantic.version
from pydantic import BaseModel

from recce.exceptions import RecceException


def pydantic_model_json_dump(model: BaseModel):
    pydantic_version = pydantic.version.VERSION
    pydantic_major = pydantic_version.split(".")[0]

    if pydantic_major == "1":
        return model.json()
    elif pydantic_major == "2":
        return model.model_dump_json()
    else:
        raise RecceException("Currently only support pydantic version 1 and 2.")
