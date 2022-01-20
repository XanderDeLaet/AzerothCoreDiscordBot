#!/bin/bash

check_port () {
  local port=$1;

  echo "Checking port $port";

  timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$port"
  if [ "$?" == "0" ]; then
    echo "Open";
    return 0
  else
    echo "Closed";
    return 1
  fi
}

wait_for_ports () {
  echo 'Checking ports...';

  local p1=3355;
  local p2=3356;
  local p3=3380;
  local p1_open=1;
  local p2_open=1;
  local p3_open=1;

  check_port $p1;
  if [ "$?" == '0' ]; then p1_open=0; fi
  check_port $p2;
  if [ "$?" == '0' ]; then p2_open=0; fi
  check_port $p3;
  if [ "$?" == '0' ]; then p3_open=0; fi

  if [ "$p1_open" == '0' ] && [ "$p2_open" == '0' ] && [ "$p3_open" == '0' ]; then
    return;
  else
    sleep 5
    wait_for_ports;
  fi
}
