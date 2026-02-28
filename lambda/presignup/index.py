"""
Cognito Pre Sign-Up Lambda Trigger
Rejects sign-ups from non-@clemson.edu email addresses.
"""

ALLOWED_DOMAIN = "clemson.edu"


def handler(event, context):
    email = event.get("request", {}).get("userAttributes", {}).get("email", "")

    if not email.lower().endswith(f"@{ALLOWED_DOMAIN}"):
        raise Exception(f"Sign-ups are restricted to @{ALLOWED_DOMAIN} email addresses.")

    # Auto-confirm the user so they don't need email verification
    event["response"]["autoConfirmUser"] = False
    event["response"]["autoVerifyEmail"] = False

    return event
