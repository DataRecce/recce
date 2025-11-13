from pydantic import BaseModel


class UserProfile(BaseModel):
    email: str
    id: int
    login: str
    login_type: str
    onboarding_state: str
