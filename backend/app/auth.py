import os
import logging
from fastapi import Header, HTTPException
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

AZURE_TENANT_ID = (os.getenv("AZURE_TENANT_ID") or "").strip()
AZURE_CLIENT_ID = (os.getenv("AZURE_CLIENT_ID") or "").strip()

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/discovery/v2.0/keys"
        _jwks_client = PyJWKClient(url, cache_keys=True)
    return _jwks_client


def get_current_user(authorization: str = Header(None)):
    if not AZURE_TENANT_ID or not AZURE_CLIENT_ID:
        logger.warning("AZURE_TENANT_ID / AZURE_CLIENT_ID not set — auth disabled")
        return {"oid": "dev", "name": "Dev User", "preferred_username": "dev@local"}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization[7:]
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/v2.0",
            options={"verify_exp": True, "verify_iat": True},
            audience=None,
        )
        if claims.get("tid") != AZURE_TENANT_ID:
            raise HTTPException(status_code=401, detail="Token from wrong tenant")
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
