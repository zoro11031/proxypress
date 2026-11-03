FROM python:3.13-alpine

WORKDIR /app
COPY proxy-press.html proxy-press-server.py ./

RUN adduser -D -H -u 10001 proxypress
USER proxypress

ENV HOST=0.0.0.0 \
    PORT=8642 \
    NO_BROWSER=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8642

CMD ["python3", "proxy-press-server.py"]
