// pages/index.tsx

import React from 'react';
import { getSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { initializeServiceAccountApis, listProjectOverviewFiles, findReferenceLog, fetchReferenceOfSubsidiaryNames } from '../lib/server/googleAPI';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import { Container, Typography, Select, MenuItem, FormControl, InputLabel } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: theme.palette.grey[200],
    },
    formControl: {
      margin: theme.spacing(1),
      minWidth: 120,
    },
    selectEmpty: {
      marginTop: theme.spacing(2),
    },
  }),
);

export const getServerSideProps: GetServerSideProps = async (context) => {
  // ... (your existing server-side logic here)
};

const Home = ({ projectsByYear, user, error }) => {
  const classes = useStyles();
  const [year, setYear] = React.useState('');

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setYear(event.target.value as string);
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <div className={classes.root}>
      <Container maxWidth="sm">
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Project Management System
        </Typography>
        <FormControl variant="outlined" className={classes.formControl}>
          <InputLabel id="year-select-label">Select Year</InputLabel>
          <Select
            labelId="year-select-label"
            id="year-select"
            value={year}
            onChange={handleChange}
            label="Select Year"
          >
            {Object.keys(projectsByYear).map(year => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Add more UI elements here to display projects based on the selected year */}
      </Container>
    </div>
  );
};

export default Home;
