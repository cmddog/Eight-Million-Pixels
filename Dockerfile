FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["sh", "-c", "npx drizzle-kit migrate && npm run start:prod"]
