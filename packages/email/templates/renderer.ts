import Handlebars from 'handlebars'
import { defaultTemplates } from './defaults'
import type {
  RenderTemplateInput,
  RenderTemplateResult,
  TemplateDefinition,
  TemplateKey,
} from '../types'

class TemplateNotFoundError extends Error {}
class TemplateVariableError extends Error {}

function validateVariables(template: TemplateDefinition, variables: Record<string, any>) {
  const missing = template.variables
    .filter((v) => v.required)
    .filter((v) => variables[v.name] === undefined || variables[v.name] === null)
    .map((v) => v.name)

  if (missing.length > 0) {
    throw new TemplateVariableError(`Missing required variables: ${missing.join(', ')}`)
  }
}

function compile(content: string, variables: Record<string, any>) {
  const tpl = Handlebars.compile(content, { noEscape: false })
  return tpl(variables)
}

export function renderTemplate(input: RenderTemplateInput): RenderTemplateResult {
  const { template, variables } = input
  validateVariables(template, variables)

  return {
    subject: compile(template.subject, variables),
    html: compile(template.html, variables),
    text: template.text ? compile(template.text, variables) : undefined,
  }
}

export function renderTemplateByKey(
  key: TemplateKey,
  variables: Record<string, any>
): RenderTemplateResult {
  const template = defaultTemplates[key]
  if (!template) {
    throw new TemplateNotFoundError(`Template not found for key: ${key}`)
  }

  return renderTemplate({ template, variables })
}

export { TemplateNotFoundError, TemplateVariableError }

