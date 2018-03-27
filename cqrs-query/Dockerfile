FROM node:boron
MAINTAINER David Dyke (david.dyke@nebulr.com.au)
COPY package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p /usr/src/app && mv -v /tmp/node_modules /usr/src
WORKDIR /usr/src/app
COPY . /usr/src/app
ENV PORT 80
EXPOSE 80
CMD npm start