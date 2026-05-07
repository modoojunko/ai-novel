FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD sh -c 'echo "window.__RUNTIME_CONFIG__ = { API_BASE_URL: \"$API_BASE_URL\" };" > /app/dist/env.js && npx vite preview --port ${PORT:-3000} --host 0.0.0.0 --allowed-hosts all'
