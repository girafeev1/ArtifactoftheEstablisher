import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiPopover: { defaultProps: { container: () => document.body } },
    MuiPopper: { defaultProps: { container: () => document.body } },
    MuiMenu: { defaultProps: { container: () => document.body } },
    MuiDialog: {
      defaultProps: {
        container:
          typeof window !== 'undefined' ? () => document.body : undefined,
      },
    },
  },
  zIndex: { modal: 1500 },
});

export default theme;
