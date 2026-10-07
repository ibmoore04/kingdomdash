import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Phase 6: Mobile PWA Safe Area Polish & Touch Density (Zero Overflow)', () => {
  const rootManifestPath = path.resolve(__dirname, '../../../../public/manifest.json')
  const frontendManifestPath = path.resolve(__dirname, '../../../../FRONTEND/public/manifest.json')

  const rootHtmlPath = path.resolve(__dirname, '../../../../index.html')
  const frontendHtmlPath = path.resolve(__dirname, '../../../../FRONTEND/index.html')

  const srcCssPath = path.resolve(__dirname, '../../../styles/index.css')
  const frontendCssPath = path.resolve(__dirname, '../../../../FRONTEND/src/styles/index.css')

  const srcBottomNavPath = path.resolve(__dirname, '../../../components/rider/layout/rider-bottom-nav.tsx')
  const frontendBottomNavPath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/components/rider/layout/rider-bottom-nav.tsx'
  )

  it('verifies 1:1 dual directory parity for manifest.json and index.html', () => {
    expect(fs.existsSync(rootManifestPath)).toBe(true)
    expect(fs.existsSync(frontendManifestPath)).toBe(true)
    expect(fs.readFileSync(rootManifestPath, 'utf8')).toBe(fs.readFileSync(frontendManifestPath, 'utf8'))

    expect(fs.existsSync(rootHtmlPath)).toBe(true)
    expect(fs.existsSync(frontendHtmlPath)).toBe(true)
    expect(fs.readFileSync(rootHtmlPath, 'utf8')).toBe(fs.readFileSync(frontendHtmlPath, 'utf8'))
  })

  it('verifies manifest.json defines valid PWA configuration for mobile installation', () => {
    const manifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'))

    expect(manifest.name).toContain('KingdomDash')
    expect(manifest.short_name).toBe('KingdomDash')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#E50914')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  })

  it('verifies index.html declares viewport-fit=cover and iOS standalone web app tags', () => {
    const html = fs.readFileSync(rootHtmlPath, 'utf8')

    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('apple-mobile-web-app-capable')
    expect(html).toContain('theme-color')
    expect(html).toContain('rel="manifest"')
  })

  it('verifies safe-area insets and padding in CSS and mobile navigation', () => {
    const css = fs.readFileSync(srcCssPath, 'utf8')
    expect(css).toContain('--safe-area-bottom: env(safe-area-inset-bottom, 0px);')
    expect(css).toContain('.pb-safe')
    expect(css).toContain('.bottom-safe')
    expect(css).toBe(fs.readFileSync(frontendCssPath, 'utf8'))

    const bottomNav = fs.readFileSync(srcBottomNavPath, 'utf8')
    expect(bottomNav).toContain('env(safe-area-inset-bottom')

    const frontendBottomNav = fs.readFileSync(frontendBottomNavPath, 'utf8')
    expect(bottomNav).toBe(frontendBottomNav)
  })
})
