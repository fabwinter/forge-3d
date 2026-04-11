import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client

security = HTTPBearer()

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        service_key = os.environ["SUPABASE_SERVICE_KEY"]
        _supabase = create_client(url, service_key)
    return _supabase


def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Verify a Supabase JWT and return the decoded user payload.
    Raises HTTP 401 if the token is invalid or expired.
    """
    token = credentials.credentials
    try:
        sb = _get_supabase()
        response = sb.auth.get_user(token)
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {
            "id": response.user.id,
            "email": response.user.email,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {exc}") from exc
