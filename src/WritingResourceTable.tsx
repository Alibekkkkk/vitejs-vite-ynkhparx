import { getMatchingWritingResources, type WritingResource } from './writingResources';

type Props = {
  resources: WritingResource[];
  taskType: 1 | 2;
  assessmentId?: string;
  questionId?: string;
};

export function WritingResourceTable({ resources, taskType, assessmentId, questionId }: Props) {
  const available = getMatchingWritingResources(resources, taskType, assessmentId, questionId);
  if (!available.length) return <p className="writing-resource-empty">
    {assessmentId && questionId
      ? 'No published resource matches this exact assessment and prompt. Publish the resource and link it to this assessment/prompt, or clear its assessment link to make it available to matching Task 1 or Task 2 prompts.'
      : 'No published vocabulary resources are linked to this task yet.'}
  </p>;

  return (
    <div className="writing-resource-list">
      {available.map(resource => (
        <article className="writing-resource" key={resource.id}>
          <h3>{resource.title}</h3>
          {resource.description && <p>{resource.description}</p>}
          {resource.sections.map(section => (
            <section key={section.id} aria-labelledby={`resource-${resource.id}-${section.id}`}>
              <h4 id={`resource-${resource.id}-${section.id}`}>{section.title}</h4>
              <div className="writing-resource__table-scroll">
                <table>
                  <caption className="sr-only">{resource.title}: {section.title}</caption>
                  <thead><tr>{section.columns.map((column, index) => <th key={`${section.id}-${index}`} scope="col">{column}</th>)}</tr></thead>
                  <tbody>{section.rows.map((row, index) => <tr key={`${section.id}-${index}`}>
                    <td className="writing-resource__original">{row.original}</td>
                    <td>{row.definition}</td>
                    <td className="writing-resource__alternatives">{row.alternatives.join(', ')}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
          ))}
        </article>
      ))}
    </div>
  );
}
