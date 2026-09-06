'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  Factory,
  FlaskConical,
  Truck,
  Check,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const modules = [
  {
    name: 'Procurement',
    icon: Boxes,
    heading: 'A strong start. Every time.',
    description:
      'Keep purchases, receiving, and stock connected. Give every delivery a clear path from supplier to store.',
    steps: ['Purchase order', 'Goods received', 'Stock recorded'],
    detail: 'Supplier records · Purchase tracking · Inventory',
  },
  {
    name: 'Production',
    icon: Factory,
    heading: 'Turn plans into progress.',
    description:
      'Connect the materials going in with the products coming out. Keep production runs and their outputs in view.',
    steps: ['Materials allocated', 'Production run', 'Finished output'],
    detail: 'Raw materials · Production runs · Output records',
  },
  {
    name: 'Quality',
    icon: FlaskConical,
    heading: 'Confidence at every checkpoint.',
    description:
      'Bring receiving assessments and quality checks into the same workflow, with records your team can follow.',
    steps: ['Receiving assessment', 'Quality checks', 'Results recorded'],
    detail: 'Assessments · Quality records · Traceability',
  },
  {
    name: 'Sales & dispatch',
    icon: Truck,
    heading: 'Ready for the next destination.',
    description:
      'Bring orders, available products, and deliveries together so your team can coordinate the next move.',
    steps: ['Customer order', 'Dispatch planning', 'Delivery recorded'],
    detail: 'Customer records · Sales orders · Dispatch',
  },
];

export function WorkspaceExplorer() {
  const [selected, setSelected] = useState(0);
  const current = modules[selected];
  return (
    <section
      className="je-workspace"
      id="workspace"
      aria-labelledby="workspace-title"
    >
      <div className="je-section-heading" data-reveal>
        <p className="je-eyebrow">01 / THE WORKSPACE</p>
        <h2 id="workspace-title">
          Many moving parts.
          <br />
          <em>One clear picture.</em>
        </h2>
        <p>
          Less chasing updates. More moving forward.
          <br />
          Explore the work that brings us together.
        </p>
      </div>
      <div
        className="je-module-buttons"
        aria-label="Explore workspace modules"
        data-reveal
      >
        {modules.map(({ name, icon: Icon }, index) => (
          <button
            key={name}
            type="button"
            aria-pressed={selected === index}
            aria-controls="module-detail"
            onClick={() => setSelected(index)}
          >
            <Icon size={19} strokeWidth={1.5} />
            <span>{name}</span>
            <span className="je-module-number">0{index + 1}</span>
          </button>
        ))}
      </div>
      <div
        className="je-module-detail"
        id="module-detail"
        data-reveal
        onPointerMove={(event) => {
          if (
            event.pointerType !== 'mouse' ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
          )
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            '--spot-x',
            `${event.clientX - bounds.left}px`,
          );
          event.currentTarget.style.setProperty(
            '--spot-y',
            `${event.clientY - bounds.top}px`,
          );
        }}
      >
        <div className="je-module-copy" aria-live="polite">
          <p className="je-eyebrow">CONNECTED OPERATIONS / 0{selected + 1}</p>
          <h3>{current.heading}</h3>
          <p>{current.description}</p>
          <Link href="/sign-in" className="je-text-link">
            Open your workspace <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="je-workflow" aria-label={`${current.name} workflow`}>
          <div className="je-workflow-heading">
            <span>{current.name} workflow</span>
            <span className="je-workflow-label">AT A GLANCE</span>
          </div>
          <ol>
            {current.steps.map((step, index) => (
              <li key={step}>
                <span className="je-step-icon">
                  {index === 2 ? (
                    <Check size={16} />
                  ) : (
                    <span>0{index + 1}</span>
                  )}
                </span>
                <span>{step}</span>
                <ArrowRight size={16} />
              </li>
            ))}
          </ol>
          <p>{current.detail}</p>
        </div>
      </div>
    </section>
  );
}
