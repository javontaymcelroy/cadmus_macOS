import { BaseEditor } from '../../shared/components'
import { DefaultToolbar } from './DefaultToolbar'

export function DefaultEditor() {
  return (
    <BaseEditor
      toolbar={(editor) => <DefaultToolbar editor={editor} />}
      placeholder="Start writing..."
      emptyMessage="Select a document to start editing"
    />
  )
}
