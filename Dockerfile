FROM python:3.13-alpine

WORKDIR /app
COPY proxy-press.html proxy-press-server.py og.png ./
COPY assets/ ./assets/
# Runtime dependencies must remain available when Compose mounts custom assets.
COPY assets/vendor/jspdf.umd.min.js ./runtime-assets/vendor/jspdf.umd.min.js
COPY assets/studio3/ ./runtime-assets/studio3/
COPY assets/vendor/fonts/ ./runtime-assets/vendor/fonts/

RUN adduser -D -H -u 10001 proxypress && mkdir -p cache && chown -R proxypress cache assets
USER proxypress

ENV HOST=0.0.0.0 \
    PORT=8642 \
    NO_BROWSER=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8642

CMD ["python3", "proxy-press-server.py"]
