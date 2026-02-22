// frontend/src/pages/components/CodeDiffView.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { FaRegCheckSquare, FaChevronDown, FaLock } from 'react-icons/fa'
import { diffChars } from 'diff'
import { Highlight, themes } from 'prism-react-renderer'
import '../../styling/CodeDiffView.scss'

type DiffMode = 'short' | 'long'

type NewJsonResult = {
    name: string
    description?: string
    passed: boolean
    hidden?: boolean
    shortDiff?: string
    longDiff?: string
    shortDiffSameAsLong?: boolean
}

type AnyPayload = {
    results?: any[]
}

type DiffEntry = {
    id: string
    num: number
    test: string
    description: string
    status: string
    passed: boolean
    skipped: boolean
    shortDiff: string
    longDiff: string
    shortDiffSameAsLong: boolean
    hidden: boolean
}

type CodeFile = {
    name: string
    content: string
}

type Seg = { text: string; changed: boolean }

const MAX_CHANGE_RATIO_FOR_INTRA = 0.7

function safeJsonParse(maybe: any): any {
    if (typeof maybe !== 'string') return maybe
    const s = maybe.trim()
    if (!s) return maybe
    if (!(s.startsWith('{') || s.startsWith('['))) return maybe
    try {
        return JSON.parse(s)
    } catch {
        return maybe
    }
}

function intralineSegments(a: string, b: string): { a: Seg[]; b: Seg[] } {
    const parts = diffChars(a ?? '', b ?? '')
    const A: Seg[] = []
    const B: Seg[] = []
    for (const p of parts) {
        if ((p as any).added) {
            B.push({ text: (p as any).value, changed: true })
        } else if ((p as any).removed) {
            A.push({ text: (p as any).value, changed: true })
        } else {
            A.push({ text: (p as any).value, changed: false })
            B.push({ text: (p as any).value, changed: false })
        }
    }
    return { a: A, b: B }
}

function areSimilarForIntra(a: string, b: string): boolean {
    const parts = diffChars(a ?? '', b ?? '')
    let changed = 0
    const total = Math.max((a ?? '').length, (b ?? '').length, 1)
    for (const p of parts) {
        if ((p as any).added || (p as any).removed) changed += (p as any).value.length
    }
    return changed / total <= MAX_CHANGE_RATIO_FOR_INTRA
}

function renderSegs(segs: Seg[], cls: 'add-ch' | 'del-ch') {
    return segs.map((seg, idx) =>
        seg.changed ? (
            <span key={idx} className={`intra ${cls}`}>
                {seg.text}
            </span>
        ) : (
            <span key={idx}>{seg.text}</span>
        )
    )
}

type CodeDiffViewProps = {
    submissionId: number

    // Optional: enable grading-like behaviors (AdminGrading uses these)
    codeSectionTitle?: string
    diffViewRef?: React.RefObject<HTMLElement | null>
    codeContainerRef?: React.RefObject<HTMLDivElement | null>
    lineRefs?: React.MutableRefObject<Record<number, HTMLLIElement | null>>
    getLineClassName?: (lineNo: number) => string
    onLineMouseEnter?: (lineNo: number) => void
    onLineMouseLeave?: (lineNo: number) => void
    onLineMouseDown?: (lineNo: number) => void
    onLineMouseUp?: () => void
    rightPanel?: React.ReactNode
    betweenDiffAndCode?: React.ReactNode
    belowCode?: React.ReactNode
    onActiveTestcaseChange?: (tc: { name: string; num: number; passed: boolean; longDiff: string; shortDiff: string }) => void

    // If true: prevent selection/copying in the diff (student view).
    // If false/undefined: allow selecting/copying (admin views).
    disableCopy?: boolean

    // If true: show the "Output hidden" banner, but still reveal the diff/output below (admin views).
    // If false/undefined: keep hidden outputs hidden (student view).
    revealHiddenOutput?: boolean

}

export default function CodeDiffView(props: CodeDiffViewProps) {
    const {
        submissionId,
        diffViewRef,
        codeSectionTitle = 'Submitted Code',
        codeContainerRef,
        lineRefs,
        getLineClassName,
        onLineMouseEnter,
        onLineMouseLeave,
        onLineMouseDown,
        onLineMouseUp,
        rightPanel,
        betweenDiffAndCode,
        belowCode,
        onActiveTestcaseChange,
        disableCopy = false,
        revealHiddenOutput = false,
    } = props

    const internalCodeContainerRef = useRef<HTMLDivElement | null>(null)
    const effectiveCodeContainerRef = codeContainerRef ?? internalCodeContainerRef

    const copyBlockHandlers = disableCopy
        ? {
            onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
            onCut: (e: React.ClipboardEvent) => e.preventDefault(),
        }
        : {}

    const [testsLoaded, setTestsLoaded] = useState(false)
    const [payload, setPayload] = useState<AnyPayload>({ results: [] })

    const [codeFiles, setCodeFiles] = useState<CodeFile[]>([])
    const [selectedCodeFile, setSelectedCodeFile] = useState<string>('')

    const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null)
    const [diffMode, setDiffMode] = useState<DiffMode>('short')

    // Intra-line highlight toggle
    const initialIntraRef = useRef<boolean>(Math.random() < 0.5)
    const [intraEnabled, setIntraEnabled] = useState<boolean>(initialIntraRef.current)

    // Track which (submissionId) we've already logged to avoid duplicate logs (React StrictMode)
    const initLogKeyRef = useRef<string | null>(null)
    
    /*
    const logUiClick = (
        action: 'Diff Finder' | 'Diff Mode',
        startedState?: boolean,
        switchedTo?: boolean
    ) => {
        if (submissionId < 0) return
        axios.post(
            `${import.meta.env.VITE_API_URL}/submissions/log_ui`,
            {
                id: submissionId,
                action,
                started_state: startedState,
                switched_to: switchedTo,
            },
            { headers: { Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}` } }
        )
    }
    */

    useEffect(() => {
        setTestsLoaded(false)
        setCodeFiles([])
        setSelectedCodeFile('')

        if (submissionId < 0) {
            setPayload({ results: [] })
            setTestsLoaded(true)
            return
        }

        axios
            .get(`${import.meta.env.VITE_API_URL}/submissions/testcaseerrors?id=${submissionId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}` },
            })
            .then((res) => {
                const maybe = safeJsonParse(res.data)
                setPayload((maybe && typeof maybe === 'object' ? maybe : { results: [] }) as AnyPayload)
                setTestsLoaded(true)
            })
            .catch((err) => {
                console.log(err)
                setPayload({ results: [] })
                setTestsLoaded(true)
            })
    }, [submissionId])

    // Baseline the toggles on mount per submission/class
    useEffect(() => {
        if (submissionId < 0) return
        const key = `${submissionId}`
        if (initLogKeyRef.current === key) return
        initLogKeyRef.current = key
        //logUiClick('Diff Mode', diffMode === 'long', diffMode === 'long')
        //logUiClick('Diff Finder', initialIntraRef.current, initialIntraRef.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submissionId])

    useEffect(() => {
        if (submissionId < 0) {
            setCodeFiles([{ name: 'Submission', content: '' }])
            setSelectedCodeFile('Submission')
            return
        }

        axios
            .get(
                `${import.meta.env.VITE_API_URL}/submissions/codefinder?id=${submissionId}&format=json`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}` } }
            )
            .then((res) => {
                const data = safeJsonParse(res.data) as any

                // New shape: { files: [{ name, content }, ...] }
                if (data && typeof data === 'object' && Array.isArray(data.files)) {
                    const files: CodeFile[] = data.files
                        .filter((f: any) => f && typeof f.name === 'string')
                        .map((f: any) => ({ name: String(f.name), content: String(f.content ?? '') }))

                    setCodeFiles(files)
                    setSelectedCodeFile((prev) =>
                        prev && files.some((ff) => ff.name === prev) ? prev : files[0]?.name ?? ''
                    )
                    return
                }

                // Backward compat: old endpoint returned a single string
                if (typeof data === 'string') {
                    setCodeFiles([{ name: 'Submission', content: data }])
                    setSelectedCodeFile('Submission')
                    return
                }

                // Last-resort fallback
                setCodeFiles([{ name: 'Submission', content: '' }])
                setSelectedCodeFile('Submission')
            })
            .catch((err) => {
                console.log(err)
                setCodeFiles([{ name: 'Submission', content: '' }])
                setSelectedCodeFile('Submission')
            })
    }, [submissionId])

    const diffFilesAll: DiffEntry[] = useMemo(() => {
        const raw = Array.isArray(payload?.results) ? payload.results : []
        const entries: DiffEntry[] = []

        raw.forEach((r: any, idx: number) => {
            const rr = (r ?? {}) as NewJsonResult
            const testName = String(rr.name ?? `Test ${idx + 1}`)
            const passed = Boolean(rr.passed)
            entries.push({
                id: `${idx}__${testName}`,
                num: idx + 1,
                test: testName,
                description: String(rr.description ?? ''),
                status: passed ? 'Passed' : 'Failed',
                passed: passed,
                skipped: false,
                shortDiff: String(rr.shortDiff ?? ''),
                longDiff: String(rr.longDiff ?? ''),
                shortDiffSameAsLong: Boolean(rr.shortDiffSameAsLong),
                hidden: Boolean(rr.hidden),
            })
        })
        return entries.sort((a, b) => Number(a.passed) - Number(b.passed) || a.test.localeCompare(b.test))
    }, [payload])

    useEffect(() => {
        if (!selectedDiffId && diffFilesAll.length > 0) {
            setSelectedDiffId(diffFilesAll[0].id)
        } else if (selectedDiffId && diffFilesAll.every((f) => f.id !== selectedDiffId)) {
            setSelectedDiffId(diffFilesAll[0]?.id ?? null)
        }
    }, [diffFilesAll, selectedDiffId])

    const selectedFile = useMemo(
        () => diffFilesAll.find((f) => f.id === selectedDiffId) || null,
        [diffFilesAll, selectedDiffId]
    )

    useEffect(() => {
        if (!onActiveTestcaseChange) return
        if (!selectedFile) return
        onActiveTestcaseChange({
            name: selectedFile.test,
            num: selectedFile.num,
            passed: selectedFile.passed,
            longDiff: selectedFile.longDiff ?? '',
            shortDiff: selectedFile.shortDiff ?? '',
        })
    }, [selectedFile, onActiveTestcaseChange])

    const showDiffModeToggle = useMemo(() => {
        if (!selectedFile || selectedFile.passed) return false
        if (selectedFile.hidden && !revealHiddenOutput) return false
        return !selectedFile.shortDiffSameAsLong
    }, [selectedFile, revealHiddenOutput])

    // If short and long are identical, force long so we never show an empty "short".
    useEffect(() => {
        if (!selectedFile || selectedFile.passed) return
        if (selectedFile.shortDiffSameAsLong && diffMode !== 'long') {
            setDiffMode('long')
        }
    }, [selectedFile, diffMode])

    const selectedDiffText = useMemo(() => {
        if (!selectedFile) return ''
        if (selectedFile.passed) return ''
        if (selectedFile.hidden && !revealHiddenOutput) return ''
        if (selectedFile.shortDiffSameAsLong) return selectedFile.longDiff ?? ''
        return diffMode === 'short' ? (selectedFile.shortDiff ?? '') : (selectedFile.longDiff ?? '')
    }, [selectedFile, diffMode, revealHiddenOutput])

    const hasIntraInSelected = useMemo(() => {
        if (!selectedFile || selectedFile.passed) return false
        if (selectedFile.hidden && !revealHiddenOutput) return false
        const txt = selectedDiffText || ''
        const lines = txt.split('\n')
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i] ?? ''
            if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue
            const next = lines[i + 1] ?? ''

            const isSingleAdd = line.startsWith('+') && !line.startsWith('+++')
            const isSingleDel = line.startsWith('-') && !line.startsWith('---')
            const nextIsSingleAdd = next.startsWith('+') && !next.startsWith('+++')
            const nextIsSingleDel = next.startsWith('-') && !next.startsWith('---')
            const pairable = (isSingleDel && nextIsSingleAdd) || (isSingleAdd && nextIsSingleDel)

            if (!pairable) continue

            const delText = (isSingleDel ? line : next).slice(1)
            const addText = (isSingleDel ? next : line).slice(1)
            if (areSimilarForIntra(delText, addText)) return true
        }
        return false
    }, [selectedFile, selectedDiffText, revealHiddenOutput])

    const selectedCode = useMemo(() => {
        if (codeFiles.length === 0) return null
        return codeFiles.find((f) => f.name === selectedCodeFile) ?? codeFiles[0]
    }, [codeFiles, selectedCodeFile])

    const codeText = selectedCode?.content ?? ''
    const language =
        selectedCode?.name?.endsWith('.py')
            ? 'python'
            : selectedCode?.name?.endsWith('.java')
                ? 'java'
                : 'clike'

    const isLineClickable = Boolean(onLineMouseDown)

    const DiffView = () => {
        return (
            <section
                className={`diff-view ${disableCopy ? 'no-user-select' : ''}`}
                {...copyBlockHandlers}
                ref={diffViewRef}
            >
                <h2 className="section-title">Testcases</h2>
                <div className="diff-content">
                    <aside className="diff-sidebar">
                        <ul className="diff-file-list">
                            {!testsLoaded && <li className="muted">Loading…</li>}
                            {testsLoaded && diffFilesAll.length === 0 && <li className="muted">No tests.</li>}
                            {diffFilesAll.sort((a, b) => a.num - b.num).map((f) => (
                                <li
                                    key={f.id}
                                    className={
                                        'file-item ' +
                                        (f.id === selectedDiffId ? 'selected ' : '') +
                                        (f.passed ? 'passed' : 'failed')
                                    }
                                    onClick={() => setSelectedDiffId(f.id)}
                                    title={`Testcase ${f.num}: ${f.test}`}
                                >
                                    <div className="testcase-name">
                                        <span className="tc-num">{f.num}.</span> {f.test}
                                    </div>
                                    <div className="testcase-sub">
                                        <span className={'status-dot ' + (f.passed ? 'is-pass' : 'is-fail')} />
                                        {f.status}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    <div className="diff-pane">
                        <div className="diff-toolbar">
                            <div className="diff-title">
                                {selectedFile ? `Testcase ${selectedFile.num}: ${selectedFile.test}` : 'No selection'}
                            </div>

                            <div className="spacer" />

                            {/* Button 1: shortDiff vs longDiff */}
                            {showDiffModeToggle && (
                                <button
                                    type="button"
                                    className={`btn toggle-mode ${diffMode === 'long' ? 'on' : 'off'}`}
                                    aria-pressed={diffMode === 'long'}
                                    onClick={() => {
                                        const next: DiffMode = diffMode === 'short' ? 'long' : 'short'
                                        //logUiClick('Diff Mode', diffMode === 'long', next === 'long')
                                        setDiffMode(next)
                                    }}
                                    title="Toggle between shortDiff and longDiff"
                                >
                                    Diff Mode: {diffMode === 'short' ? 'Short' : 'Long'}
                                </button>
                            )}

                            {/* Button 2: Diff Finder */}
                            {selectedFile && !selectedFile.passed && (!selectedFile.hidden || revealHiddenOutput) && (
                                <button
                                    type="button"
                                    className={`btn toggle-intra ${intraEnabled ? 'on' : 'off'}`}
                                    aria-pressed={intraEnabled}
                                    disabled={!hasIntraInSelected}
                                    onClick={() => {
                                        const next = !intraEnabled
                                        //logUiClick('Diff Finder', initialIntraRef.current, next)
                                        setIntraEnabled(next)
                                    }}
                                    title={
                                        hasIntraInSelected
                                            ? 'Toggle intra-line highlighting'
                                            : 'Intra-line highlighting is not available for this diff'
                                    }
                                >
                                    Diff Finder: {intraEnabled ? 'On' : 'Off'}
                                </button>
                            )}
                        </div>

                        <div className="diff-code">
                            {!selectedFile && <div className="muted">Select a test on the left to view its diff.</div>}

                            {selectedFile && selectedFile.hidden && (
                                <div className="diff-content">
                                    <div className="diff-empty hidden" role="status" aria-live="polite">
                                        <div className="empty-icon" aria-hidden="true">
                                            <FaLock />
                                        </div>
                                        <div className="empty-text">
                                            <div className="empty-title">Output hidden</div>
                                            <div className="empty-subtitle">
                                                This testcase’s output is hidden. Result: {selectedFile.passed ? 'Passed' : 'Failed'}.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedFile && (!selectedFile.hidden || revealHiddenOutput) && selectedFile.passed && (

                                <div className="diff-content">
                                    <div className="diff-empty" role="status" aria-live="polite">
                                        <div className="empty-icon" aria-hidden="true">
                                            <FaRegCheckSquare />
                                        </div>
                                        <div className="empty-text">
                                            <div className="empty-title">No differences found</div>
                                            <div className="empty-subtitle">Your program’s output matches the expected output.</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedFile && (!selectedFile.hidden || revealHiddenOutput) && !selectedFile.passed && (
                                <div className="diff-content">
                                    {(() => {
                                        const txt = selectedDiffText || ''
                                        if (!txt.trim()) {
                                            return <div className="muted">No diff text was provided for this test in {diffMode}.</div>
                                        }

                                        const lines = txt.split('\n')
                                        const out: JSX.Element[] = []

                                        for (let i = 0; i < lines.length; i++) {
                                            const line = lines[i] ?? ''

                                            // Headers/hunks first so they never pair or get intra
                                            if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
                                                const headerCls = line.startsWith('---')
                                                    ? 'del header'
                                                    : line.startsWith('+++')
                                                        ? 'add header'
                                                        : 'meta header'
                                                out.push(
                                                    <div key={i} className={`diff-line ${headerCls}`}>
                                                        {line || ' '}
                                                    </div>
                                                )
                                                continue
                                            }

                                            const type = line[0]
                                            const content = line.slice(1)
                                            const next = lines[i + 1] ?? ''

                                            const isSingleAdd = line.startsWith('+') && !line.startsWith('+++')
                                            const isSingleDel = line.startsWith('-') && !line.startsWith('---')
                                            const nextIsSingleAdd = next.startsWith('+') && !next.startsWith('+++')
                                            const nextIsSingleDel = next.startsWith('-') && !next.startsWith('---')
                                            const pairable = (isSingleDel && nextIsSingleAdd) || (isSingleAdd && nextIsSingleDel)

                                            if (pairable) {
                                                const otherContent = next.slice(1)
                                                const addText = type === '-' ? otherContent : content
                                                const delText = type === '-' ? content : otherContent

                                                if (!intraEnabled || !areSimilarForIntra(delText, addText)) {
                                                    out.push(
                                                        <div key={`d-${i}`} className="diff-line del">
                                                            <span className="diff-sign">-</span>
                                                            {delText || '\u00A0'}
                                                        </div>
                                                    )
                                                    out.push(
                                                        <div key={`a-${i + 1}`} className="diff-line add">
                                                            <span className="diff-sign">+</span>
                                                            {addText || '\u00A0'}
                                                        </div>
                                                    )
                                                    i++
                                                    continue
                                                }

                                                const { a, b } = intralineSegments(delText, addText)
                                                out.push(
                                                    <div key={`d-${i}`} className="diff-line del">
                                                        <span className="diff-sign">-</span>
                                                        {renderSegs(a, 'del-ch')}
                                                    </div>
                                                )
                                                out.push(
                                                    <div key={`a-${i + 1}`} className="diff-line add">
                                                        <span className="diff-sign">+</span>
                                                        {renderSegs(b, 'add-ch')}
                                                    </div>
                                                )
                                                i++
                                                continue
                                            }

                                            const cls = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx'

                                            out.push(
                                                <div key={i} className={`diff-line ${cls}`}>
                                                    {line || ' '}
                                                </div>
                                            )
                                        }

                                        return out
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    const CodeView = () => {
        return (
            <section className="code-section">
                <h2 className="section-title">{codeSectionTitle}</h2>
                {codeFiles.length === 0 && <div className="no-data-message">Fetching submitted code…</div>}

                {codeFiles.length > 0 && (
                    <>
                        {codeFiles.length > 1 && (
                            <div className="code-file-picker">
                                <label className="section-label" htmlFor="codefile-select">
                                    File Selection
                                </label>
                                <div className="select-wrap">
                                    <select
                                        id="codefile-select"
                                        className="select"
                                        value={selectedCodeFile}
                                        onChange={(e) => setSelectedCodeFile(e.target.value)}
                                    >
                                        {codeFiles.map((f) => (
                                            <option key={f.name} value={f.name}>
                                                {f.name}
                                            </option>
                                        ))}
                                    </select>
                                    <FaChevronDown className="select-icon" aria-hidden="true" />
                                </div>
                            </div>
                        )}
                        <Highlight theme={themes.vsLight} code={codeText} language={language as any}>
                            {({ style, tokens, getLineProps, getTokenProps }) => (
                                <div
                                    className={`code-block code-viewer ${isLineClickable ? 'line-clickable' : ''}`}
                                    ref={effectiveCodeContainerRef}
                                    onMouseLeave={onLineMouseUp ? () => onLineMouseUp() : undefined}
                                    role="region"
                                    aria-label="Submitted source code"
                                >
                                    <ol className="code-list" style={style}>
                                        {tokens.map((line, i) => {
                                            const lineNo = i + 1
                                            const { key: lineKey, ...lineProps } = getLineProps({ line, key: i })
                                            const extraCls = getLineClassName ? getLineClassName(lineNo) : ''
                                            return (
                                                <li
                                                    key={lineKey ?? lineNo}
                                                    ref={(el) => {
                                                        if (lineRefs) lineRefs.current[lineNo] = el
                                                    }}
                                                    {...lineProps}
                                                    className={`code-line ${extraCls} ${lineProps.className ?? ''}`}
                                                    onMouseDown={onLineMouseDown ? () => onLineMouseDown(lineNo) : undefined}
                                                    onMouseEnter={onLineMouseEnter ? () => onLineMouseEnter(lineNo) : undefined}
                                                    onMouseLeave={onLineMouseLeave ? () => onLineMouseLeave(lineNo) : undefined}
                                                    onMouseUp={onLineMouseUp ? () => onLineMouseUp() : undefined}
                                                    title={
                                                        onLineMouseDown ? 'Click this line to add or view grading errors' : undefined
                                                    }
                                                >
                                                    <span className="gutter">
                                                        <span className="line-number">{lineNo}</span>
                                                    </span>
                                                    <span className="code-text">
                                                        {line.map((token, key) => {
                                                            const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key })
                                                            return <span key={tokenKey ?? key} {...tokenProps} />
                                                        })}
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ol>
                                </div>
                            )}
                        </Highlight>
                    </>
                )}
            </section>
        )
    }

    return (
        <>
            {rightPanel ? (
                <div className="diff-code-panel">
                    <div className="diff-and-code">
                        <DiffView />

                        {betweenDiffAndCode}

                        <CodeView />
                        
                        {belowCode}
                    </div>

                    {rightPanel}
                </div>
            ) : (
                <>
                    <DiffView />

                    {betweenDiffAndCode}

                    <CodeView />

                    {belowCode}
                </>
            )}
        </>
    )
}