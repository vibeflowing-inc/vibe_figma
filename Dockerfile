FROM oven/bun:1

WORKDIR /usr/src/app

COPY package.json .
RUN bun install

COPY . .

EXPOSE 8000/tcp

ENTRYPOINT [ "bun", "run", "src/index.ts" ]
