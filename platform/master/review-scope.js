import registry from '../projects.json' with {type:'json'};
// The agency's own advertising is excluded from client morning reviews.
// This policy does not change project status, dashboard access or import scope.
export const reviewProjectIncluded=project=>project?.id!=='prj_toys_agency_ctft'&&project?.slug!=='toys-agency-ctft'&&project?.id!=='prj_nova_sales_demo'&&!registry[project?.slug]?.synthetic;
