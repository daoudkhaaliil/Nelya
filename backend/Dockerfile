FROM node:20-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# [BUG-007 FIX] npm start lance 'node src/server.js' (pas nodemon)
CMD ["npm", "start"]
