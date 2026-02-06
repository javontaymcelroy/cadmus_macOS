import { BaseEditor } from '../../shared/components'
import { AcademicToolbar } from './AcademicToolbar'

export function AcademicEditor() {
  return (
    <BaseEditor
      toolbar={(editor) => <AcademicToolbar editor={editor} />}
      placeholder="Start writing your academic paper..."
      emptyMessage="Select a document to start writing"
    />
  )
}
