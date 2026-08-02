/**
 * script.js is ~9,000 lines of pre-existing browser globals, so the rules here
 * are the ones that catch real defects in that style of code — undefined
 * variables, duplicate keys, unreachable branches — rather than style.
 */
export default [
    {
        ignores: ['node_modules/**', 'dist/**', 'Fantasy-Premier-League/**', 'data/**']
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'script',
            globals: {
                window: 'readonly', document: 'readonly', console: 'readonly',
                localStorage: 'readonly', fetch: 'readonly', setTimeout: 'readonly',
                clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
                requestAnimationFrame: 'readonly', navigator: 'readonly', location: 'readonly',
                Chart: 'readonly', ChartDataLabels: 'readonly', AbortController: 'readonly',
                URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
                matchMedia: 'readonly', getComputedStyle: 'readonly', alert: 'readonly',
                Image: 'readonly', performance: 'readonly', structuredClone: 'readonly',
                process: 'readonly', globalThis: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'no-const-assign': 'error',
            'no-func-assign': 'error',
            'no-cond-assign': 'error',
            'no-self-compare': 'error',
            'no-unsafe-negation': 'error',
            'valid-typeof': 'error',
            'use-isnan': 'error',
            'no-sparse-arrays': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }]
        }
    },
    {
        files: ['tests/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.mjs'],
        languageOptions: {
            sourceType: 'module',
            // Request/Response are Node's built-in fetch globals; the Worker test
            // uses them to stand in for workerd.
            globals: {
                Buffer: 'readonly', __dirname: 'readonly',
                Request: 'readonly', Response: 'readonly', Headers: 'readonly'
            }
        }
    },
    {
        // The smoke test drives a browser: the identifiers inside page.evaluate
        // callbacks resolve in the page, not in Node.
        files: ['tests/smoke/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                document: 'readonly', window: 'readonly', state: 'readonly',
                charts: 'readonly',
                switchDraftTab: 'readonly', showTab: 'readonly', setRowMode: 'readonly',
                sortTable: 'readonly', setTrendWindow: 'readonly',
                switchMainView: 'readonly', setChartPosition: 'readonly',
                openSettings: 'readonly', renderDraftBoard: 'readonly',
                draftBoardPool: 'readonly', panelPicks: 'readonly',
                DRAFT_PANELS: 'readonly', invalidateSignals: 'readonly',
                computeDraftMetrics: 'readonly',
                setFreeAgentsOnly: 'readonly', toggleFreeAgentsOnly: 'readonly',
                openLeaderboard: 'readonly', sortLeaderboard: 'readonly',
                signalFor: 'readonly', displayNetTransfers: 'readonly',
                applyMarketOverlay: 'readonly', processChange: 'readonly',
                setChartFacet: 'readonly', renderCharts: 'readonly'
            }
        }
    },
    {
        // Cloudflare Worker: an ES module running on workerd, not in a page.
        files: ['fpl-proxy-worker/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: { Response: 'readonly', Request: 'readonly', Headers: 'readonly', URL: 'readonly', caches: 'readonly', fetch: 'readonly' }
        }
    },
    {
        // The optional local dev proxy is CommonJS under Node.
        files: ['local_proxy.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: { require: 'readonly', module: 'writable', process: 'readonly', Buffer: 'readonly' }
        }
    }
];
