import { useEffect, useMemo, useState } from 'react'

import {
  Box,
  Chip,
  Divider,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Cormorant_Infant } from 'next/font/google'
import { fetchBankAccountsDirectory } from '../../lib/bankAccountsDirectory'

import type { ProjectRecord } from '../../lib/projectsDatabase'
import type { ReactNode } from 'react'

const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })

interface TextSegment {
  text: string
  isCjk: boolean
}

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

const splitByCjkSegments = (value: string | null | undefined): TextSegment[] => {
  if (!value) {
    return []
  }

  const segments: TextSegment[] = []
  for (const char of Array.from(value)) {
    const isCjk = CJK_REGEX.test(char)
    const last = segments[segments.length - 1]
    if (last && last.isCjk === isCjk) {
      last.text += char
    } else {
      segments.push({ text: char, isCjk })
    }
  }
  return segments
}

const textOrNA = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value : 'N/A'

const formatAmount = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'HK$0'
  }
  return `HK$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const labelSx = {
  fontWeight: 400,
  fontSize: '0.9rem',
  letterSpacing: '0.02em',
} as const

const valueSx = {
  fontSize: '1.2rem',
  lineHeight: 1.3,
} as const

let bankAccountLabelCache: Map<string, string> | null = null
let bankAccountLabelPromise: Promise<Map<string, string>> | null = null

const getBankAccountLabelMap = async (): Promise<Map<string, string>> => {
  if (bankAccountLabelCache) {
    return bankAccountLabelCache
  }
  if (!bankAccountLabelPromise) {
    bankAccountLabelPromise = fetchBankAccountsDirectory().then((records) => {
      const map = new Map<string, string>()
      records.forEach((record) => {
        const label = record.accountType
          ? `${record.bankName} - ${record.accountType}`
          : record.bankName
        map.set(record.accountId, label)
      })
      bankAccountLabelCache = map
      return map
    })
  }
  return bankAccountLabelPromise
}

interface ProjectDatabaseDetailContentProps {
  project: ProjectRecord
  headerActions?: ReactNode
  onClose?: () => void
  onEdit?: () => void
}

export default function ProjectDatabaseDetailContent({
  project,
  headerActions,
  onClose,
  onEdit,
}: ProjectDatabaseDetailContentProps) {
  const [payToLabel, setPayToLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!project.paidTo) {
        if (!cancelled) {
          setPayToLabel(null)
        }
        return
      }

      try {
        const map = await getBankAccountLabelMap()
        if (!cancelled) {
          setPayToLabel(map.get(project.paidTo) ?? null)
        }
      } catch (err) {
        console.error('[ProjectDatabaseDetailContent] failed to load bank account labels:', err)
        if (!cancelled) {
          setPayToLabel(null)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [project.paidTo])

  const detailItems = useMemo(() => {
    const invoiceValue: ReactNode = project.invoice
      ? project.invoice.startsWith('http')
        ? (
            <Link
              href={project.invoice}
              target="_blank"
              rel="noopener"
              sx={{ fontFamily: 'inherit', fontWeight: 'inherit' }}
            >
              {project.invoice}
            </Link>
          )
        : textOrNA(project.invoice)
      : 'N/A'

    return [
      { label: 'Client Company', value: textOrNA(project.clientCompany) },
      {
        label: 'Project Pickup Date',
        value: project.projectDateDisplay ?? '-',
      },
      { label: 'Amount', value: formatAmount(project.amount) },
      { label: 'Paid', value: project.paid ? '🤑' : '👎🏻' },
      {
        label: 'Paid On',
        value: project.paid ? project.onDateDisplay ?? '-' : '-',
      },
      {
        label: 'Pay To',
        value: payToLabel ?? textOrNA(project.paidTo),
      },
      { label: 'Invoice', value: invoiceValue },
    ] satisfies Array<{ label: string; value: ReactNode }>
  }, [payToLabel, project])

  const presenterBase = textOrNA(project.presenterWorkType)
  const presenterText = presenterBase === 'N/A' ? presenterBase : `${presenterBase} -`
  const presenterSegments = splitByCjkSegments(presenterText)

  const projectTitleText = textOrNA(project.projectTitle)
  const titleSegments = splitByCjkSegments(projectTitleText)

  return (
    <Stack spacing={1.2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
        spacing={1.5}
      >
        <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack
            direction='row'
            alignItems='center'
            spacing={1}
            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
          >
            <Typography variant='subtitle1' color='text.secondary'>
              {project.projectNumber}
            </Typography>
            {onEdit && (
              <IconButton onClick={onEdit} aria-label='Edit project' size='small'>
                <EditOutlinedIcon fontSize='small' />
              </IconButton>
            )}
          </Stack>
          <Typography variant='subtitle1' sx={{ color: 'text.primary' }}>
            {presenterSegments.length === 0
              ? presenterText
              : presenterSegments.map((segment, index) => (
                  <span
                    key={`presenter-segment-${index}`}
                    className={segment.isCjk ? 'iansui-text' : 'federo-text'}
                  >
                    {segment.text}
                  </span>
                ))}
          </Typography>
          <Typography
            variant='h4'
            sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}
          >
            {titleSegments.length === 0
              ? projectTitleText
              : titleSegments.map((segment, index) => (
                  <span
                    key={`title-segment-${index}`}
                    className={segment.isCjk ? 'yuji-title' : undefined}
                  >
                    {segment.text}
                  </span>
                ))}
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            {textOrNA(project.projectNature)}
          </Typography>
        </Stack>
        <Stack spacing={0.75} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
          <Stack direction='row' spacing={0.5} alignItems='center'>
            {headerActions}
            {onClose && (
              <IconButton onClick={onClose} aria-label='close project details' size='small'>
                <CloseIcon fontSize='small' />
              </IconButton>
            )}
          </Stack>
          {project.subsidiary && (
            <Chip
              label={textOrNA(project.subsidiary)}
              variant='outlined'
              size='small'
              sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}
            />
          )}
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={1.2}>
        {detailItems.map(({ label, value }) => (
          <Box key={label}>
            <Typography sx={labelSx} className='karla-label'>
              {label}:
            </Typography>
            <Typography component='div' sx={valueSx} className={cormorantSemi.className}>
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  )
}
