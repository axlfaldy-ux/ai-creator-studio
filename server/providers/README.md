# Provider integration boundary

Provider-specific network calls and credentials belong in backend modules. Frontend code should call only the studio's `/api/*` routes and should never receive third-party API keys.

## OpenAI images

`POST /api/images/generate` uses OpenAI's Image API. With a reference image it calls the image edit endpoint; without one it calls image generation. The API key is read only from the server environment (`OPENAI_API_KEY`). The model can be selected with `OPENAI_IMAGE_MODEL`.

## Google Flow / video

No Google Flow API endpoint or authentication contract is assumed here. Flow remains a product-level integration request, not a working provider. When Google documents a supported server API for the intended workflow, add a backend adapter that owns credentials and exposes asynchronous operations such as submit, check status, cancel, and retrieve artifact. Keep provider job identifiers and polling details inside that adapter. Do not call undocumented Flow endpoints or claim compatibility with a separate Google video API as Flow integration.
