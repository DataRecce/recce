import pydantic.version
from pydantic import BaseModel


def pydantic_model_json_dump(model: BaseModel):
    pydantic_version = pydantic.version.VERSION
    pydantic_major = pydantic_version.split(".")[0]

    if pydantic_major == "1":
        return model.json()
    else:
        return model.model_dump_json()
