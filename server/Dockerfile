FROM node:17-alpine3.12

ENV ANNOUNCED_IP="127.0.0.1"
ENV ORIGIN="http://localhost:3001"
WORKDIR /app

RUN apk add g++ make python3 linux-headers && \
    apk add --update py3-pip && \
    sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.1.2/zsh-in-docker.sh)"

COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY . .
CMD [ "node", "app.js" ]
