import { GetServerSideProps } from 'next'

const ProjectsDatabaseIndex = () => null

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/dashboard/businesses/projects/select',
      permanent: false,
    },
  }
}

export default ProjectsDatabaseIndex
