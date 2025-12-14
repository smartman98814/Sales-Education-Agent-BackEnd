FROM node:iron-alpine

LABEL version="1.0"
LABEL description='This is the docker image for NFA Agent API.'

WORKDIR /app

COPY ["package.json", "yarn.lock", "tsconfig.json", "./"]
RUN ls
RUN yarn --frozem-lockfile
COPY . .
RUN yarn build

EXPOSE 3005

CMD ["yarn", "start"]
