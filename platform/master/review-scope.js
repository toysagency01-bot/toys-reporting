import registry from '../projects.json' with {type:'json'};
// The agency's own advertising is excluded from client morning reviews.
// This policy does not change project status, dashboard access or import scope.
export const reviewProjectIncluded=project=>project?.id!=='prj_toys_agency_ctft'&&project?.slug!=='toys-agency-ctft'&&project?.id!=='prj_nova_sales_demo'&&!registry[project?.slug]?.synthetic;

// Telegram delivery preferences do not remove reviews from the platform.
const telegramExcludedIds=new Set(['prj_visa_agency_qa3b','prj_karlovarska_sul_k4rm']);
const telegramExcludedSlugs=new Set(['visa-agency-qa3b','karlovarska-sul-k4rm']);
export const telegramProjectIncluded=project=>reviewProjectIncluded(project)&&!telegramExcludedIds.has(project?.id)&&!telegramExcludedSlugs.has(project?.slug);
