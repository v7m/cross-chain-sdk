#!/bin/bash

docker run \
  --name solana-validator \
  -p 8899:8899 \
  -p 8900:8900 \
  -p 9900:9900 \
  solana-validator:3.1.3 \
  solana-test-validator \
  --clone metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  --clone worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth \
  --clone wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb \
  --url https://api.mainnet-beta.solana.com \
  --reset
