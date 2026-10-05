export type ReconnectFieldName =
  | 'contactDate'
  | 'contactType'
  | 'contactMethod'
  | 'employerName'
  | 'streetAddress'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'websiteUrl'
  | 'emailAddress'
  | 'telephone'
  | 'fax'
  | 'personContacted'
  | 'workType'
  | 'jobTitle'
  | 'referenceNumber'
  | 'result';

export type ReconnectControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface ReconnectFieldMap {
  fields: Partial<Record<ReconnectFieldName, ReconnectControl>>;
  ambiguous: ReconnectFieldName[];
  missing: ReconnectFieldName[];
}

const DEFINITIONS: Record<ReconnectFieldName, string[]> = {
  contactDate: ['dateofcontact', 'contactdate'],
  contactType: ['typeofcontact', 'contacttype'],
  contactMethod: ['methodofcontact', 'contactmethod', 'howdidyoucontactthem'],
  employerName: ['employeragencywebsitecontactname', 'employeragencyname', 'employername', 'contactname'],
  streetAddress: ['addressline1', 'streetaddress', 'address1'],
  city: ['city'],
  state: ['state'],
  postalCode: ['zipcode', 'postalcode', 'zip'],
  websiteUrl: ['websiteaddressurl', 'websiteaddress', 'websiteurl', 'url'],
  emailAddress: ['emailaddress', 'email'],
  telephone: ['telephonenumber', 'telephone', 'phone'],
  fax: ['faxnumber', 'fax'],
  personContacted: ['nameofthepersonyoucontacted', 'personcontacted', 'namepersoncontacted'],
  workType: ['typeofworkyouwerelookingfor', 'typeofworksought', 'worktype'],
  jobTitle: ['positionyouappliedfor', 'jobtitle', 'positionappliedfor'],
  referenceNumber: ['positionreferencenumber', 'referencenumber', 'positionnumber'],
  result: ['resultofemployercontact', 'resultofcontact', 'result']
};

function normalized(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function labelText(document: Document, control: ReconnectControl): string {
  const chunks: string[] = [];
  if (control.id) {
    for (const label of Array.from(document.querySelectorAll('label'))) {
      if (label.getAttribute('for') === control.id) chunks.push(label.textContent ?? '');
    }
  }
  const wrappingLabel = control.closest('label');
  if (wrappingLabel) chunks.push(wrappingLabel.textContent ?? '');
  return normalized(chunks.join(' '));
}

function candidates(document: Document, aliases: string[]): ReconnectControl[] {
  const controls = Array.from(document.querySelectorAll<ReconnectControl>('input:not([type="hidden"]), select, textarea'));
  return controls.filter((control) => {
    const id = normalized(control.id);
    const name = normalized(control.getAttribute('name'));
    const label = labelText(document, control);
    return aliases.some((alias) => id === alias || name === alias || label === alias || label.includes(alias));
  });
}

export function mapReconnectFields(document: Document): ReconnectFieldMap {
  const fields: Partial<Record<ReconnectFieldName, ReconnectControl>> = {};
  const ambiguous: ReconnectFieldName[] = [];
  const missing: ReconnectFieldName[] = [];

  for (const [field, aliases] of Object.entries(DEFINITIONS) as [ReconnectFieldName, string[]][]) {
    const matches = [...new Set(candidates(document, aliases))];
    if (matches.length === 1) fields[field] = matches[0];
    else if (matches.length > 1) ambiguous.push(field);
    else missing.push(field);
  }

  return { fields, ambiguous, missing };
}
