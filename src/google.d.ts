// Tipos mínimos para o Google Identity Services (carregado via <script> em index.html).
interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (resp: GoogleTokenResponse) => void
          error_callback?: (err: unknown) => void
        }) => GoogleTokenClient
        revoke: (token: string, done?: () => void) => void
      }
    }
  }
}
