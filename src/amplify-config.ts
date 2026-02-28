import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      ...(import.meta.env.VITE_IDENTITY_POOL_ID ? { identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID } : {}),
    },
  },
})
