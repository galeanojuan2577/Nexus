FROM node:22-alpine AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

ENV API_SCHEME=https \
    API_HOST=nexus-backend.onrender.com

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
