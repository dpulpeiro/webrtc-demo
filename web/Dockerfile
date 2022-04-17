FROM node:14.17-alpine3.13 as node

WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN npm ci
COPY ./ /app/
RUN npm run build
FROM nginx:mainline-alpine
EXPOSE 80
COPY --from=node /app/build/ /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
