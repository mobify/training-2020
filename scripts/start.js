#!/usr/bin/env node

/* eslint import/no-commonjs:0 */
/* eslint-env node */
const Promise = require('bluebird')
const _fs = require('fs')
const path = require('path')
const process = require('process')
const program = require('commander')

const childProcess = require('@lerna/child-process')

const fs = Promise.promisifyAll(_fs)

const resolve = path.resolve
const resolveBin = (name) => resolve(__dirname, '..', 'node_modules', '.bin', name)
const buildPath = resolve(process.cwd(), 'build')
const marker = resolve(buildPath, 'build.marker')
const ssrJS = resolve(buildPath, 'ssr.js')

const development = 'development'
const isWindows = process.platform === 'win32'
const nodemon = resolveBin(isWindows ? 'nodemon.cmd' : 'nodemon')
const webpack = resolveBin(isWindows ? 'webpack.cmd' : 'webpack')

const spawnStreaming = ({command, args, opts, name}) => {
    return childProcess.spawnStreaming(command, args, opts, name)
}

/**
 * Generate hash manifest that is expected to be in place before starting
 * the app.
 */
const beforeRun = () => {
    return Promise.resolve().then(() => {
        // Ensure required dirs exist for nodemon and webpack
        if (!fs.existsSync(buildPath)) {
            fs.mkdirSync(buildPath)
            fs.closeSync(fs.openSync(ssrJS, 'w'))
        }
    })
}

const runSSR = ({inspect}) => {
    const nodeEnv = process.env.NODE_ENV || development
    const brand = process.env.BRAND

    return Promise.resolve()
        .then(() => beforeRun())
        .then(() => {
            return [
                {
                    command: webpack,
                    args: ['--env.ctx', brand, '--mode', nodeEnv, '--watch'],
                    opts: {
                        env: Object.assign({}, process.env, {
                            TOUCH_BUILD_MARKER: 1,
                            DEVTOOL: nodeEnv === development ? 'source-map' : 'cheap-source-map'
                        })
                    },
                    name: 'webpack'
                },
                {
                    command: nodemon,
                    args: [
                        '--watch',
                        marker,
                        '--on-change-only',
                        '--no-colours',
                        '--delay',
                        '0.25',
                        '--',
                        ...(inspect ? ['--inspect=localhost:9229'] : []),
                        ...[ssrJS]
                    ],
                    opts: {
                        env: process.env
                    },
                    name: 'ssr-server'
                }
            ].map(spawnStreaming)
        })
}

program.description('Startup script for the UPWA')

program
    .command('ssr')
    .description('Start the PWA in server-side rendering mode')
    .action(runSSR)
    .option('--inspect', 'Enable debugging (default: false)')

program.parse(process.argv)
