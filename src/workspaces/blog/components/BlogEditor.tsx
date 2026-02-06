import { BaseEditor } from '../../shared/components'
import { BlogToolbar } from './BlogToolbar'

export function BlogEditor() {
  return (
    <BaseEditor
      toolbar={(editor) => <BlogToolbar editor={editor} />}
      placeholder="Start writing your blog post..."
      emptyMessage="Select a document to start writing"
    />
  )
}
