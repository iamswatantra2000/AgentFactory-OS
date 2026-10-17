import { CheckCircleIcon, UserCircleIcon, ScrollIcon, CircleIcon } from '@phosphor-icons/react/ssr';
import styles from './landing.module.css';
const steps = [
  {
    initials: 'DA',
    name: 'Data Analyst',
    type: 'AI role',
    context: 'Recent product usage, support tickets, and customer feedback.',
    output: 'Cleaned and organized findings',
    mobile: 'Organize the customer data',
    tone: 'sand',
  },
  {
    initials: 'RW',
    name: 'Research Writer',
    type: 'AI role',
    context: 'Key themes, customer quotes, and trends from the findings.',
    output: 'Draft brief with key takeaways',
    mobile: 'Draft the insights brief',
    tone: 'lavender',
  },
  {
    initials: 'VC',
    name: 'Visual Creator',
    type: 'AI role',
    context: 'Reviewed draft and company brand guidelines.',
    output: 'Presentation and summary visuals',
    mobile: 'Prepare the summary visuals',
    tone: 'sage',
  },
  {
    initials: '',
    name: 'You',
    type: 'Human reviewer',
    context: 'Check accuracy, tone, and fit with your business goals.',
    output: 'Your approval before sharing',
    mobile: 'Review and make the decision',
    tone: 'sand',
  },
];
export function WorkflowPreview() {
  return (
    <figure className={styles.preview} aria-labelledby="workflow-preview-title">
      <figcaption className={styles.previewLabel}>
        Illustrative workflow <span>Sample data · not a live run</span>
      </figcaption>
      <div className={styles.previewTitle}>
        <span className={styles.documentIcon}>
          <ScrollIcon size={26} weight="light" aria-hidden="true" />
        </span>
        <div>
          <h2 id="workflow-preview-title">Prepare the weekly customer insights brief</h2>
          <p>A clear handoff. An accountable owner. Your final say.</p>
        </div>
      </div>
      <div className={styles.workflowTableWrap}>
        <table className={styles.workflowTable}>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Owner</th>
              <th scope="col">Context</th>
              <th scope="col">Output</th>
              <th scope="col">Review</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => (
              <tr key={step.name}>
                <td className={styles.stepCell}>
                  <span>{index + 1}</span>
                </td>
                <td>
                  <div className={styles.owner}>
                    <span className={`${styles.avatar} ${styles[step.tone]}`} aria-hidden="true">
                      {step.initials || <UserCircleIcon size={30} weight="light" />}
                    </span>
                    <div>
                      <strong>{step.name}</strong>
                      <small className={styles.roleType}>{step.type}</small>
                      <small className={styles.mobileTask}>{step.mobile}</small>
                    </div>
                  </div>
                </td>
                <td className={styles.contextCell}>{step.context}</td>
                <td className={styles.outputCell}>{step.output}</td>
                <td className={styles.reviewCell}>
                  <span
                    aria-label={
                      index === 3
                        ? 'Human approval required in this example'
                        : 'Example review checkpoint'
                    }
                  >
                    {index === 3 ? (
                      <CircleIcon size={24} weight="light" />
                    ) : (
                      <CheckCircleIcon size={24} weight="fill" />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.previewFootnote}>Designed to show the work—not to imply it has run.</p>
    </figure>
  );
}
