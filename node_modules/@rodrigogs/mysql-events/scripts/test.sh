#!/bin/bash

### CONFIG
export MSYS_NO_PATHCONV=1; # git-bash workaroung for Windows

my_dir="$(dirname "$0")";

### PROGRAM
docker-compose up -d;
echo 'Waiting for docker services...';
while ! docker exec mysql55 mysqladmin ping -h'127.0.0.1' --silent; do sleep 3; done
while ! docker exec mysql56 mysqladmin ping -h'127.0.0.1' --silent; do sleep 3; done
while ! docker exec mysql57 mysqladmin ping -h'127.0.0.1' --silent; do sleep 3; done
while ! docker exec mysql80 mysqladmin ping -h'127.0.0.1' --silent; do sleep 3; done

### SINGLE CONNECTION
docker run --rm -t \
  --net=host \
  -v `pwd`:/app \
  -w /app node:8-alpine \
  /bin/sh -c "npm install && npm test"

exitCode=$?;

### CONNECTION POOL
if [ "$exitCode" == "0" ]; then
  docker run --rm -t \
    --net=host \
    -v `pwd`:/app \
    -w /app node:8-alpine \
    /bin/sh -c "export IS_POOL=true; npm test"

  exitCode=$?;
fi

docker-compose down -v;

exit $exitCode;
