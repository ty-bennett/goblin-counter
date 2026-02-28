"""
Cognito Pre Sign-Up Lambda Trigger
Rejects sign-ups from non-@clemson.edu email addresses.
Auto-confirms valid users so no verification code is required.
"""

ALLOWED_DOMAIN = "clemson.edu"


def handler(event, context):
    email = event.get("request", {}).get("userAttributes", {}).get("email", "")

    if not email.lower().endswith(f"@{ALLOWED_DOMAIN}"):
        raise Exception("You are not a part of the clemson.edu domain.")

    # Auto-confirm and auto-verify so no email code is required
    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True

    return event
