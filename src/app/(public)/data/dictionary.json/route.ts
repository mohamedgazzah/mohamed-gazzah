import { METHODOLOGY_VERSION } from '@/db/enums'
import { EXPORT_FIELDS } from '@/lib/dictionary'

export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    methodology_version: METHODOLOGY_VERSION,
    fields: EXPORT_FIELDS.map((f) => ({
      name: f.column,
      type: f.type,
      nullable: !!f.nullable,
      allowed_values: f.allowed ?? null,
      description: f.description,
    })),
  })
}
