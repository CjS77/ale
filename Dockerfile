FROM node:9
MAINTAINER "Cayle Sharrock <cayle@nimbustech.biz>"
EXPOSE 8813
ENV NODE_ENV=production
USER node

RUN mkdir /home/node/app
WORKDIR /home/node/app
ADD --chown=node:node . ./
RUN yarn
RUN yarn add pg pg-hstore

CMD ["node", "/home/node/app/server.js"]
